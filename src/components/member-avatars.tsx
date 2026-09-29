import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MemberAvatars({
  members,
}: {
  members: { id: string; name: string }[];
}) {
  return (
    <span className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-2 text-base/6">
      {members.map(({ id, name }) => (
        <span key={id} className="inline-flex items-center gap-2">
          <Avatar
            aria-hidden="true"
            size="sm"
            className="data-[size=sm]:size-5.5"
          >
            <AvatarImage
              src={`/avatars/${encodeURIComponent(id)}.webp`}
              alt=""
              width={22}
              height={22}
              draggable={false}
            />
            <AvatarFallback>{[...name][0]}</AvatarFallback>
          </Avatar>
          <span>{name}</span>
        </span>
      ))}
    </span>
  );
}
