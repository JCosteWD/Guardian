export function Input({ label, ...props }) {
  return (
    <div>
      {label && <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>{label}</label>}
      <input className="input" {...props} />
    </div>
  );
}
