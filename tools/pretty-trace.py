#!/usr/bin/python3
import re
import sys
import textwrap

MAX_COLUMN = 100
INDENT_SIZE = 3
INDENT = " " * INDENT_SIZE


def parse_args(args):
    if not args:
        return
    nest = []
    i = 0
    while i < len(args):
        c = args[i]
        if c == "\x1b":
            c = args[i : args.find("m", i) + 1]

        # print(f"{nest=} {i=} {c=} {args[:i]=}")
        match c:
            case "=":
                yield args[:i].strip()
                args = args[i + 1 :].strip()
                i = 0
                continue

            case ",":
                if not nest:
                    yield args[:i].strip()
                    args = args[i + 1 :].strip()
                    i = 0
                    continue

            case "(" | "[":
                nest.append(c)

            case ")" | "]":
                assert nest.pop() == {")": "(", "]": "["}[c]
        i += len(c)

    yield args.strip()


def format(lines):
    for line in lines:
        if line.strip() == "":
            # Preserve empty lines
            yield ""
            continue

        if len(line) <= MAX_COLUMN or not re.search(r"\)$", line):
            yield line
            continue

        this_indent = " " * (len(line) - len(line.lstrip()))
        pos = line.find("(")
        yield line[: pos + 1]

        line = line[pos + 1 :].strip()
        pos = line.find(")")
        args, tail = line[:pos], line[pos:]
        args = list(parse_args(args))
        for i in range(0, len(args), 2):
            # print(f"{i=} {args[i]=} {args[i+1]=}")
            param, value = args[i], args[i + 1]
            yield textwrap.fill(
                this_indent + INDENT + f"{param} = {value},",
                MAX_COLUMN,
                subsequent_indent=this_indent + INDENT + "\\ ",
            )
        yield textwrap.fill(
            this_indent + tail, MAX_COLUMN, subsequent_indent=this_indent + INDENT
        )


print("\n".join(format(sys.stdin.read().splitlines())))
