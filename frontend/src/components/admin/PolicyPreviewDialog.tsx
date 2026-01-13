import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface PolicyPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    contentHtml: string | null;
    lastUpdated?: string;
}

export function PolicyPreviewDialog({
    open,
    onOpenChange,
    title,
    contentHtml,
    lastUpdated
}: PolicyPreviewDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[70vh] flex flex-col p-0 gap-0 bg-white overflow-hidden rounded-xl border-none shadow-2xl">
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <DialogTitle className="text-2xl font-bold font-playfair text-[#2C1810]">
                                {title}
                            </DialogTitle>
                            {lastUpdated && (
                                <DialogDescription className="text-sm text-muted-foreground">
                                    Last Updated: {new Date(lastUpdated).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </DialogDescription>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 p-8 md:p-12">
                    <article
                        className="
                                prose prose-slate
                                max-w-none
                                prose-base
                                md:prose-lg
                                dark:prose-invert
                                prose-headings:font-playfair
                                prose-headings:font-bold
                                prose-headings:text-[#1A1A1A]
                                prose-headings:tracking-tight
                                prose-p:text-[#4A4A4A]
                                prose-p:leading-[1.8]
                                prose-li:text-[#4A4A4A]
                                prose-li:leading-[1.8]
                                prose-strong:text-[#1A1A1A]
                                prose-strong:font-bold
                                prose-a:text-[#B85C3C]
                                prose-a:no-underline
                                hover:prose-a:underline
                                prose-ul:list-none
                                prose-ol:list-decimal
                                [&_ul]:list-none
                                [&_ol]:list-decimal
                                [&_ul]:pl-0
                                [&_li]:relative
                                [&_ul>li]:pl-7
                                [&_ul>li]:mb-2
                                [&_ul>li::before]:content-['']
                                [&_ul>li::before]:absolute
                                [&_ul>li::before]:left-0
                                [&_ul>li::before]:top-[0.7em]
                                [&_ul>li::before]:w-2
                                [&_ul>li::before]:h-2
                                [&_ul>li::before]:bg-[#B85C3C]
                                [&_ul>li::before]:rounded-full
                            "
                        dangerouslySetInnerHTML={{ __html: contentHtml || "<p class='text-muted-foreground italic'>No content available to preview.</p>" }}
                    />
                </ScrollArea>

                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close Preview
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
