/** Layout tiskových stránek – bez navigace, světlé pozadí (PDF export). */
export default function TiskLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white text-black">{children}</div>;
}
