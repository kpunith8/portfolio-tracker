import { LoaderCircle } from "lucide-react";
import "./dashboard.css";

export default function Loading() {
  return (
    <main className="dashboard-loading">
      <h1>Loading your investments</h1>
      <div className="dashboard-loading-table" aria-busy="true">
        <div className="performance-loading" role="status">
          <LoaderCircle size={24} aria-hidden="true" />
          <span>Loading data…</span>
        </div>
      </div>
    </main>
  );
}
