const reset = "\x1b[0m";
const style = (c: string) => (s: string) => `${c}${s}${reset}`;

export const clr = {
	user: style("\x1b[1;32m"),
	ai: style("\x1b[1;36m"),
	system: style("\x1b[1;35m"),
	error: style("\x1b[1;31m"),
	warn: style("\x1b[1;33m"),
	dim: style("\x1b[2m"),
};
