pub fn redact_text(input: &str) -> String {
    input
        .lines()
        .map(redact_line)
        .collect::<Vec<_>>()
        .join("\n")
}

fn redact_line(line: &str) -> String {
    let mut current = line.to_owned();
    for marker in ["sk-", "AIza"] {
        current = redact_token_family(&current, marker);
    }
    current
}

fn redact_token_family(line: &str, marker: &str) -> String {
    let mut result = String::new();
    let mut remainder = line;

    while let Some(index) = remainder.find(marker) {
        result.push_str(&remainder[..index]);
        let token = &remainder[index..];
        let end = token.find(char::is_whitespace).unwrap_or(token.len());
        result.push_str("[REDACTED]");
        remainder = &token[end..];
    }

    result.push_str(remainder);
    result
}

#[cfg(test)]
mod tests {
    use super::redact_text;

    #[test]
    fn redacts_known_api_key_prefixes() {
        let input = "key sk-ant-api03-AAAAAAAAAAAAAA\nsecondary AIzaSecret123";
        let redacted = redact_text(input);
        assert!(!redacted.contains("sk-ant-api03-"));
        assert!(!redacted.contains("AIzaSecret123"));
        assert!(redacted.contains("[REDACTED]"));
    }
}
