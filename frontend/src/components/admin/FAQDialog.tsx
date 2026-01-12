import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { FAQWithCategory } from "@/services/faq.service";
import type { Category } from "@/services/category.service";

interface FAQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (faq: {
    id?: string;
    question: string;
    answer: string;
    category_id: string;
    display_order?: number;
    is_active?: boolean;
  }) => void;
  faq: FAQWithCategory | null;
  categories: Category[];
}

export function FAQDialog({
  open,
  onOpenChange,
  onSave,
  faq,
  categories,
}: FAQDialogProps) {
  const [formData, setFormData] = useState<{
    question: string;
    answer: string;
    category_id: string;
    is_active: boolean;
  }>({
    question: "",
    answer: "",
    category_id: "",
    is_active: true,
  });

  useEffect(() => {
    if (faq) {
      setFormData({
        question: faq.question,
        answer: faq.answer,
        category_id: faq.category_id,
        is_active: faq.is_active,
      });
    } else {
      setFormData({
        question: "",
        answer: "",
        category_id: categories[0]?.id || "",
        is_active: true,
      });
    }
  }, [faq, open, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const faqData = {
      question: formData.question,
      answer: formData.answer,
      category_id: formData.category_id,
      is_active: formData.is_active,
      ...(faq?.id && { id: faq.id }),
    };

    onSave(faqData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {faq ? "Edit FAQ" : "Add New FAQ"}
          </DialogTitle>
          <DialogDescription>
            {faq
              ? "Update frequently asked question and answer"
              : "Add a new frequently asked question"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="overflow-y-auto max-h-[calc(90vh-180px)] pr-4">
            <div className="space-y-6 py-2">
              {/* Category Selection */}
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="text-base font-semibold">Category</h3>

                <div className="space-y-2">
                  <Label htmlFor="category">
                    FAQ Category <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Question & Answer */}
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="text-base font-semibold">FAQ Content</h3>

                <div className="space-y-2">
                  <Label htmlFor="question">
                    Question <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="question"
                    value={formData.question}
                    onChange={(e) =>
                      setFormData({ ...formData, question: e.target.value })
                    }
                    placeholder="Enter the FAQ question"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="answer">
                    Answer <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="answer"
                    value={formData.answer}
                    onChange={(e) =>
                      setFormData({ ...formData, answer: e.target.value })
                    }
                    placeholder="Enter the detailed answer"
                    rows={8}
                    required
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide a clear and comprehensive answer to help users.
                  </p>
                </div>
              </div>

              {/* Visibility Settings */}
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                <h3 className="text-base font-semibold">Visibility Settings</h3>

                <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
                  <div className="space-y-0.5">
                    <Label htmlFor="isActive" className="text-base">
                      Active Status
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {formData.is_active
                        ? "This FAQ will be visible on the website"
                        : "This FAQ will be hidden from the website"}
                    </p>
                  </div>
                  <Switch
                    id="isActive"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">{faq ? "Update FAQ" : "Create FAQ"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
