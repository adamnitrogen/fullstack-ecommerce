import { PolicyViewer } from "@/components/PolicyViewer";

export default function Terms() {
  return (
    <PolicyViewer
      type="terms"
      fallbackContent={
        <div className="text-center py-10">
          <h1 className="text-3xl font-bold mb-4">Terms & Conditions</h1>
          <p className="text-muted-foreground">Our Terms & Conditions are currently being updated. Please check back soon.</p>
        </div>
      }
    />
  );
}
