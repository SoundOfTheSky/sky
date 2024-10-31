export const furiganaToRuby = (s: string) =>
  s.replaceAll(
    /([一-龯]+?)\[(.+?)\]/g,
    (_, a, b) => `<ruby>${a}<rt>${b}</tr></ruby>`,
  );
export const removeFurigana = (s: string) =>
  s.replaceAll(/([一-龯]+?)\[.+?\]/g, (_, a) => a as string);
export const removeRuby = (s: string) =>
  s.replaceAll(/<ruby>(.+?)<.+?<\/ruby>/g, (_, a) => a as string);
export const furiganaToHiragana = (s: string) =>
  s.replaceAll(/[一-龯]+?\[(.+?)\]/g, (_, a) => a as string);
