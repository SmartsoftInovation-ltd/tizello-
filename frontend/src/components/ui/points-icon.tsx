import { Icon, type IconProps } from "@/components/ui/icons";

/**
 * Story points — the estimate tag on a row and the sprint header's total. Its
 * own file because `icons.tsx` sits at the 150-line cap.
 */
export function PointsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2.5l5.5 5.5L8 13.5 2.5 8z" />
    </Icon>
  );
}
