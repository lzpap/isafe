import { Member } from "@/hooks/useGetMembers";
import { shortenAddress } from "@/lib/utils/shortenAddress";

interface ApprovalProgressBarProps {
  members: Member[];
  approvedBy: string[];
  threshold: number;
}

export function ApprovalProgressBar({
  members,
  approvedBy,
  threshold,
}: ApprovalProgressBarProps) {
  const totalWeight = members.reduce((sum, m) => sum + m.weight, 0);
  const approvedWeight = members
    .filter((m) => approvedBy.includes(m.address))
    .reduce((sum, m) => sum + m.weight, 0);
  const thresholdMet = approvedWeight >= threshold;
  const thresholdPercent =
    totalWeight > 0 ? (threshold / totalWeight) * 100 : 0;

  const approvedColor = thresholdMet ? "bg-green-500" : "bg-yellow-500";
  const pendingColor = thresholdMet ? "bg-green-500/15" : "bg-foreground/10";

  // Sort approved members first so filled segments stack from left toward the threshold
  const sortedMembers = [...members].sort((a, b) => {
    const aApproved = approvedBy.includes(a.address) ? 0 : 1;
    const bApproved = approvedBy.includes(b.address) ? 0 : 1;
    return aApproved - bApproved;
  });

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-foreground/60 mb-1.5">
        <span>
          {approvedWeight} / {totalWeight} weight
        </span>
        <span>Threshold: {threshold}</span>
      </div>
      <div className="relative">
        <div className="flex h-5 rounded-lg overflow-hidden">
          {sortedMembers.map((member, idx) => {
            const isApproved = approvedBy.includes(member.address);
            const widthPercent =
              totalWeight > 0 ? (member.weight / totalWeight) * 100 : 0;
            return (
              <div
                key={member.address}
                className={`h-full transition-colors duration-300 ${
                  isApproved ? approvedColor : pendingColor
                } ${idx < sortedMembers.length - 1 ? "border-r border-background" : ""}`}
                style={{ width: `${widthPercent}%` }}
                title={`${shortenAddress(member.address)} — weight: ${member.weight}${isApproved ? " (approved)" : " (pending)"}`}
              />
            );
          })}
        </div>
        {/* Threshold marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-7 bg-foreground/70 rounded-full"
          style={{ left: `${Math.min(thresholdPercent, 100)}%` }}
          title={`Threshold: ${threshold}`}
        />
      </div>
      {/* Member labels */}
      <div className="flex mt-1">
        {sortedMembers.map((member) => {
          const isApproved = approvedBy.includes(member.address);
          const widthPercent =
            totalWeight > 0 ? (member.weight / totalWeight) * 100 : 0;
          return (
            <div
              key={member.address}
              className="text-center overflow-hidden"
              style={{ width: `${widthPercent}%` }}
            >
              <span
                className={`text-xs truncate block ${
                  isApproved ? "text-foreground/70" : "text-foreground/40"
                }`}
              >
                {shortenAddress(member.address)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
