
export function decodeEntities(msg: string) {
  // Some of our messages from the server contain html encoded
  // characters. This converts them back.
  const specialCharacters = {
    '&apos;': "'",
  };

  Object.entries(specialCharacters).map(([encodedHtml, text]) => {
    msg = msg.replace(encodedHtml, text);
  });
  
  return msg;
}