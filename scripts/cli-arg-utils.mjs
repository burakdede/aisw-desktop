export function consumeStringOption(options, optionKey, argv, index) {
  options[optionKey] = argv[index + 1] ?? "";
  return index + 1;
}
