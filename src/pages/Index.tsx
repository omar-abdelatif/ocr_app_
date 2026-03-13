import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Camera, FileText, Loader2, User, MapPin, Hash, CalendarDays, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface IdData {
  name: string;
  address: string;
  nid: string;
  birthDate: string;
  error?: string;
}

const Index = () => {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<IdData | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 10 ميجابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const extractData = async () => {
    if (!image) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("extract-id", {
        body: { image },
      });

      if (error) {
        toast.error("حدث خطأ أثناء معالجة الصورة");
        console.error(error);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResult(data as IdData);
      toast.success("تم استخراج البيانات بنجاح");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-bl from-background via-muted/30 to-background font-cairo"
    >
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">قارئ البطاقة الشخصية</h1>
            <p className="text-xs text-muted-foreground">استخراج بيانات بطاقة الرقم القومي المصرية</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Upload Area */}
        {!image ? (
          <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
            <CardContent className="p-0">
              <div
                className="flex flex-col items-center justify-center py-16 px-6 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <p className="text-lg font-semibold text-foreground mb-2">
                  اسحب صورة البطاقة هنا
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  أو اضغط لاختيار صورة من جهازك
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="w-4 h-4 ml-2" />
                    اختر ملف
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                  >
                    <Camera className="w-4 h-4 ml-2" />
                    التقط صورة
                  </Button>
                </div>
              </div>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <Input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Image Preview */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <img
                  src={image}
                  alt="صورة البطاقة"
                  className="w-full max-h-80 object-contain bg-muted/30"
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                className="flex-1"
                size="lg"
                onClick={extractData}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                    جاري الاستخراج...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 ml-2" />
                    استخراج البيانات
                  </>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={reset}>
                <RotateCcw className="w-5 h-5 ml-2" />
                إعادة
              </Button>
            </div>
          </>
        )}

        {/* Results */}
        {result && (
          <Card className="border-primary/20 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                البيانات المستخرجة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResultField icon={<User className="w-5 h-5" />} label="الاسم" value={result.name} />
              <ResultField icon={<MapPin className="w-5 h-5" />} label="العنوان" value={result.address} />
              <ResultField icon={<Hash className="w-5 h-5" />} label="الرقم القومي" value={result.nid} />
              <ResultField icon={<CalendarDays className="w-5 h-5" />} label="تاريخ الميلاد" value={result.birthDate} />
            </CardContent>
          </Card>
        )}

        {/* Footer Note */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          جميع البيانات تُعالج بشكل آمن ولا يتم تخزينها
        </p>
      </main>
    </div>
  );
};

const ResultField = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
    <div className="text-primary mt-0.5">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground break-words">{value}</p>
    </div>
  </div>
);

export default Index;
