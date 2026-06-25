export const AUDIO_OUTPUT_FORMATS = ["mp3", "wav", "m4a", "ogg", "flac", "opus"] as const;

export type AudioOutputFormat = (typeof AUDIO_OUTPUT_FORMATS)[number];

type AudioCodecMap = Record<AudioOutputFormat, string>;

const AUDIO_CODECS: AudioCodecMap = {
  mp3: "libmp3lame",
  wav: "pcm_s16le",
  m4a: "aac",
  ogg: "libvorbis",
  flac: "flac",
  opus: "libopus",
};

const MIME_TYPES: Record<AudioOutputFormat, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  flac: "audio/flac",
  opus: "audio/opus",
};

export function normalizeAudioOutputFormat(format: string): AudioOutputFormat {
  const normalized = format.toLowerCase().replace(/^\./, "");

  if (!AUDIO_OUTPUT_FORMATS.includes(normalized as AudioOutputFormat)) {
    throw new Error(`Unsupported audio output format: ${format}`);
  }

  return normalized as AudioOutputFormat;
}

export function getAudioCodec(format: AudioOutputFormat): string {
  return AUDIO_CODECS[format];
}

export function getAudioMimeType(format: AudioOutputFormat): string {
  return MIME_TYPES[format];
}

export function replaceAudioFileExtension(
  filename: string,
  extension: string,
): string {
  const baseName = filename.replace(/\.[^/.]+$/, "");
  return `${baseName}.${extension}`;
}

export function getAudioInputFormatFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (!extension) {
    throw new Error(`Could not detect format for file: ${filename}`);
  }

  return extension;
}
