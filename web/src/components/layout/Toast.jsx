export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast" style={{ background: toast.success ? '#51CF66' : '#FF6B6B', color: '#fff' }}>
      {toast.message}
    </div>
  );
}
