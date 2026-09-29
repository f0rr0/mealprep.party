import { getImageProps } from "next/image";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MemberAvatars({
  members,
}: {
  members: { id: string; name: string; avatar?: string }[];
}) {
  return (
    <span className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-2 text-base/6">
      {members.map(({ id, name, avatar }) => (
        <span key={id} className="inline-flex items-center gap-2">
          <Avatar
            aria-hidden="true"
            size="sm"
            className="data-[size=sm]:size-5.5"
          >
            {avatar && (
              <AvatarImage
                {...getImageProps({
                  src: avatar,
                  alt: "",
                  width: 22,
                  height: 22,
                  sizes: "22px",
                }).props}
                draggable={false}
              />
            )}
            <AvatarFallback>{[...name][0]}</AvatarFallback>
          </Avatar>
          <span>{name}</span>
        </span>
      ))}
    </span>
  );
}
