import { 
  Bot, 
  Code, 
  Globe,
  Sparkles,
  FileText,
  Lightbulb
} from 'lucide-react';
import type { ComponentType, SVGAttributes } from 'react';

// Icon 映射
export const ICON_MAP: Record<string, ComponentType<SVGAttributes<SVGElement> & { size?: string | number; color?: string }>> = {
  Bot: Bot as any,
  Sparkles: Sparkles as any,
  Code: Code as any,
  FileText: FileText as any,
  Globe: Globe as any,
  Lightbulb: Lightbulb as any,
};
