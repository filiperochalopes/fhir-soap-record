import { MeuExameAttachmentAction } from "~/components/attachment-plugins/MeuExameAttachmentAction";

import type { AttachmentPlugin } from "./types";

export const attachmentPlugins: AttachmentPlugin[] = [
  {
    Action: MeuExameAttachmentAction,
    id: "meuexame",
  },
];
