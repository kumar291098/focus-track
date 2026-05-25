export default function EmptyChart({ message }: { message: string }) {
  return (
    <div className="empty-chart">
      <div className="empty-orbit" />
      <strong>No activity yet</strong>
      <p>{message}</p>
    </div>
  );
}
