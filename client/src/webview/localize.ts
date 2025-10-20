let localizedTerms = null;
const localize = (term: string) => {
  if (!localizedTerms) {
    try {
      localizedTerms = JSON.parse(
        document.querySelector("#l10n-messages").textContent,
      );
    } catch (e) {}
  }
  return localizedTerms[term] ?? term;
};

export default localize;
