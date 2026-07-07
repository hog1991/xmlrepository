import { useState, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseXmlPayload, ParsedField } from "@/lib/xml-parser";
import { CATEGORY_MAP, OTHER_CATEGORY } from "@/lib/categories";
import { 
  FileText, 
  Upload, 
  AlertCircle, 
  ArrowLeft, 
  Download, 
  Copy, 
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const [viewState, setViewState] = useState<"input" | "results">("input");
  const [xmlInput, setXmlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedField[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const handleParse = () => {
    if (!xmlInput.trim()) {
      setError("Please paste XML data or upload a file first.");
      return;
    }
    
    setError(null);
    const { fields, error: parseError } = parseXmlPayload(xmlInput);
    
    if (parseError) {
      setError(parseError);
    } else {
      setParsedData(fields);
      setViewState("results");
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setXmlInput(content);
      setError(null);
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === "text/xml" || file.name.endsWith(".xml"))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setXmlInput(event.target?.result as string);
        setError(null);
      };
      reader.readAsText(file);
    } else {
      setError("Please drop a valid XML file.");
    }
  };

  const resetState = () => {
    setViewState("input");
    setXmlInput("");
    setParsedData([]);
    setError(null);
    setCopied(false);
  };

  // Grouping logic for results
  const groupedData: Record<string, { expected: string[], found: Record<string, string> }> = {};
  
  // Initialize with all known categories and expected fields
  Object.entries(CATEGORY_MAP).forEach(([category, fields]) => {
    groupedData[category] = { expected: fields, found: {} };
  });
  groupedData[OTHER_CATEGORY] = { expected: [], found: {} };

  // Populate found fields
  parsedData.forEach(field => {
    if (field.category === OTHER_CATEGORY) {
      groupedData[OTHER_CATEGORY].found[field.originalName] = field.value;
    } else {
      // Find the exact match in expected fields to use as key
      const expectedField = CATEGORY_MAP[field.category].find(f => f.toLowerCase() === field.originalName.toLowerCase());
      if (expectedField) {
        groupedData[field.category].found[expectedField] = field.value;
      }
    }
  });

  const getCsvContent = () => {
    let csv = "Category,Field Name,Value\n";
    Object.entries(groupedData).forEach(([category, data]) => {
      if (category === OTHER_CATEGORY && Object.keys(data.found).length === 0) return;
      
      const fieldsToRender = category === OTHER_CATEGORY 
        ? Object.keys(data.found) 
        : data.expected;

      fieldsToRender.forEach(fieldName => {
        const value = data.found[fieldName];
        const displayValue = value ? value.replace(/"/g, '""') : "—";
        csv += `"${category}","${fieldName}","${displayValue}"\n`;
      });
    });
    return csv;
  };

  const handleExport = () => {
    const csv = getCsvContent();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "agreement_extraction.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    const textToCopy = getCsvContent();
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const totalFound = parsedData.filter(f => f.value && f.value.trim() !== "").length;
  const agreementTitle = parsedData.find(f => f.originalName.toLowerCase() === "title")?.value;
  const partyName = parsedData.find(f => f.originalName.toLowerCase() === "party name")?.value;
  
  const headerSummary = [agreementTitle, partyName].filter(Boolean).join(" - ") || "Unnamed Agreement";

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="font-semibold text-foreground tracking-tight">Agreement Extraction Viewer</h1>
          </div>
          {viewState === "results" && (
            <Button variant="outline" size="sm" onClick={resetState} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Parse Another
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 animate-in fade-in duration-300">
        {viewState === "input" ? (
          <div className="space-y-6 max-w-3xl mx-auto mt-8">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-semibold tracking-tight">Review Extraction Payload</h2>
              <p className="text-muted-foreground">Paste your XML payload or upload a file to view categorized results.</p>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-destructive/5 text-destructive border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Parsing Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div 
                className={`p-6 border-b border-dashed transition-colors flex flex-col items-center justify-center gap-4 ${isDragging ? 'bg-primary/5 border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="p-3 bg-background border rounded-full shadow-sm">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Drag & drop an XML file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click below to browse</p>
                </div>
                <input 
                  type="file" 
                  accept=".xml,text/xml" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Browse Files
                </Button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Or paste XML content directly</label>
                </div>
                <Textarea 
                  value={xmlInput}
                  onChange={(e) => setXmlInput(e.target.value)}
                  placeholder="<extraction name='Total Contract Value' value='$100,000' />..."
                  className="min-h-[200px] font-mono text-xs resize-y bg-background"
                />
              </div>

              <div className="p-4 bg-muted/30 border-t flex justify-end">
                <Button size="lg" onClick={handleParse} className="px-8 shadow-sm">
                  Parse Payload
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Agreement Context</p>
                <h2 className="text-2xl font-semibold tracking-tight">{headerSummary}</h2>
                <div className="flex items-center gap-3 mt-3">
                  <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15 border-0">
                    {totalFound} fields extracted
                  </Badge>
                  <span className="text-sm text-muted-foreground">Parsed client-side successfully</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy as CSV"}
                </Button>
                <Button variant="default" size="sm" onClick={handleExport} className="gap-2 shadow-sm">
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(groupedData).map(([category, data]) => {
                const isOther = category === OTHER_CATEGORY;
                const fieldsToRender = isOther ? Object.keys(data.found) : data.expected;
                
                if (fieldsToRender.length === 0) return null;

                const foundCount = fieldsToRender.filter(f => data.found[f] && data.found[f].trim() !== "").length;
                const totalCount = fieldsToRender.length;

                return (
                  <CollapsibleSection 
                    key={category} 
                    category={category} 
                    foundCount={foundCount} 
                    totalCount={totalCount}
                  >
                    <div className="overflow-x-auto rounded-b-xl">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="px-6 py-3 font-medium text-muted-foreground w-1/3">Extracted Field</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground w-2/3">Value</th>
                          </tr>
                        </thead>
                        <tbody className="bg-card divide-y">
                          {fieldsToRender.map((fieldName, idx) => {
                            const val = data.found[fieldName];
                            const hasValue = val && val.trim() !== "";
                            return (
                              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                <td className={`px-6 py-3.5 align-top ${hasValue ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                  {fieldName}
                                </td>
                                <td className={`px-6 py-3.5 align-top ${hasValue ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                                  {hasValue ? val : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CollapsibleSection({ 
  category, 
  foundCount, 
  totalCount, 
  children 
}: { 
  category: string; 
  foundCount: number; 
  totalCount: number; 
  children: React.ReactNode 
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen}
      className="bg-card border rounded-xl shadow-sm overflow-hidden"
    >
      <CollapsibleTrigger className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors group">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-foreground">{category}</h3>
          <Badge variant="secondary" className="text-xs font-normal">
            {foundCount} / {totalCount} found
          </Badge>
        </div>
        <div className="p-1.5 rounded-md text-muted-foreground group-hover:bg-muted/50 transition-colors">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
