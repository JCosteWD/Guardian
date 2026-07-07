const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Stripe webhook signature invalid:', err.message);
    return res.status(400).json({ error: 'Webhook signature invalide' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { parentId, plan } = session.metadata;
        const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);

        await query(
          `UPDATE subscriptions SET
             plan = $1, status = 'active',
             stripe_subscription_id = $2,
             current_period_start = to_timestamp($3),
             current_period_end = to_timestamp($4),
             trial_end = to_timestamp($5)
           WHERE parent_id = $6`,
          [
            plan,
            stripeSubscription.id,
            stripeSubscription.current_period_start,
            stripeSubscription.current_period_end,
            stripeSubscription.trial_end,
            parentId,
          ]
        );
        logger.info(`Subscription activated: ${plan} for parent ${parentId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await query(
          `UPDATE subscriptions SET status = 'past_due'
           WHERE stripe_customer_id = $1`,
          [invoice.customer]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await query(
          `UPDATE subscriptions SET plan = 'free', status = 'active',
             stripe_subscription_id = NULL
           WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await query(
          `UPDATE subscriptions SET
             status = $1,
             current_period_end = to_timestamp($2),
             cancel_at_period_end = $3
           WHERE stripe_subscription_id = $4`,
          [sub.status, sub.current_period_end, sub.cancel_at_period_end, sub.id]
        );
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Erreur de traitement du webhook' });
  }
};
