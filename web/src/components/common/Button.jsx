export function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'btn btn-primary',
    ghost: 'btn btn-ghost',
    danger: 'btn btn-danger',
  };
  return (
    <button className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
