import { PlayerRoom } from "./player-room";

export default async function PlayRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PlayerRoom code={code.toUpperCase()} />;
}
