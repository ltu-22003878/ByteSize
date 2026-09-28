import { useStudent } from "./StudentContext";

export default function Toast() {
  const { toast, dismissToast } = useStudent();
  if (!toast) return null;
  const icon = toast.type === "levelup" ? "🎉" : toast.type === "warn" ? "🛡️" : "⚡";
  return (
    <div className={`toast toast-${toast.type}`} role="status" key={toast.id}>
      <span className="toast-icon">{icon}</span>
      <span>{toast.message}</span>
      <button className="toast-close" onClick={dismissToast} aria-label="Dismiss">×</button>
    </div>
  );
}
