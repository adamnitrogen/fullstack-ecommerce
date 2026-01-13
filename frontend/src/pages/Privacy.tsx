import { PolicyViewer } from "@/components/PolicyViewer";

export default function Privacy() {
  return (
    <PolicyViewer
      type="privacy"
      fallbackContent={
        <div className="text-center py-10">
          <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">Our Privacy Policy is currently being updated. Please check back soon.</p>
        </div>
      }
    />
  );
}
