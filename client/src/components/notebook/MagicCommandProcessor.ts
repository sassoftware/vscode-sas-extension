export interface MagicCommand {
  command: string;
  language: string;
  aliases?: string[];
}

export const MAGIC_COMMANDS: MagicCommand[] = [
  { command: "%sas", language: "sas", aliases: ["%s"] },
  { command: "%sql", language: "sql", aliases: ["%q"] },
  { command: "%python", language: "python", aliases: ["%py", "%p"] },
  { command: "%markdown", language: "markdown", aliases: ["%md", "%m"] },
];

export interface MagicProcessResult {
  language: string;
  code: string;
  hasMagic: boolean;
}

export class MagicCommandProcessor {
  public static process(
    content: string,
    defaultLanguage: string,
  ): MagicProcessResult {
    const lines = content.split("\n");

    const firstLine = lines[0]?.trim();
    if (!firstLine || !firstLine.startsWith("%")) {
      return {
        language: defaultLanguage,
        code: content,
        hasMagic: false,
      };
    }
    const magicCommand = firstLine.split(/\s+/)[0].toLowerCase();

    const matchedCommand = MAGIC_COMMANDS.find(
      (cmd) =>
        cmd.command === magicCommand || cmd.aliases?.includes(magicCommand),
    );

    if (!matchedCommand) {
      return {
        language: defaultLanguage,
        code: content,
        hasMagic: false,
      };
    }

    const remainingContent = lines.slice(1).join("\n");

    return {
      language: matchedCommand.language,
      code: remainingContent,
      hasMagic: true,
    };
  }
}
