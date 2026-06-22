let audioContext: AudioContext | null = null;

export async function playTaskCompletedSound() {
	if (!canUseAudio()) {
		return;
	}

	try {
		const context = getAudioContext();

		if (context.state === "suspended") {
			await context.resume();
		}

		playSoftCompletionChime(context);
	} catch {
		// Audio feedback should never block the task flow.
	}
}

function canUseAudio() {
	return typeof window !== "undefined" && Boolean(window.AudioContext);
}

function getAudioContext() {
	audioContext ??= new window.AudioContext();
	return audioContext;
}

function playSoftCompletionChime(context: AudioContext) {
	const now = context.currentTime;

	playTone(context, 660, now, 0.075, 0.055);
	playTone(context, 880, now + 0.08, 0.11, 0.045);
}

function playTone(
	context: AudioContext,
	frequency: number,
	startAt: number,
	duration: number,
	volume: number,
) {
	const oscillator = context.createOscillator();
	const gain = context.createGain();

	oscillator.type = "sine";
	oscillator.frequency.setValueAtTime(frequency, startAt);

	gain.gain.setValueAtTime(0, startAt);
	gain.gain.linearRampToValueAtTime(volume, startAt + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

	oscillator.connect(gain);
	gain.connect(context.destination);

	oscillator.start(startAt);
	oscillator.stop(startAt + duration + 0.02);
}
