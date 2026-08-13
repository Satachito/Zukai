#!/usr/bin/env python3
#	GPT-SoVITS ( voiceger ) narration bridge for tools/make-intro-video.mjs.
#
#	The voiceger app ships a Streamlit UI, not an HTTP API, so this loads the
#	same inference path its zundamon_webui.py uses — including the MhaPatched
#	context this fork needs on macOS — and renders a whole batch of lines in one
#	process, so the models are loaded once.
#
#	Usage:  voiceger-tts.py job.json
#	Job:    { "root": "…/GPT-SoVITS", "gpt": "…ckpt", "sovits": "…pth",
#	          "ref_audio": "…wav", "ref_text": "…", "ref_lang": "Japanese",
#	          "lang": "English",
#	          "items": [ { "text": "…", "out": "…wav" }, … ] }

import json
import os
import sys


def main():
	if len(sys.argv) != 2:
		raise SystemExit('usage: voiceger-tts.py job.json')
	with open(sys.argv[1], encoding='utf-8') as f:
		job = json.load(f)

	root = job['root']
	if not os.path.isdir(root):
		raise SystemExit(f'voiceger root not found: {root}')

	#	same search path the Streamlit app sets up
	sys.path.insert(0, os.path.dirname(root))
	sys.path.insert(0, root)
	sys.path.append(os.path.join(root, 'GPT_SoVITS'))
	os.chdir(root)

	#	inference_webui loads whatever these point at while it is being
	#	imported, so they have to be set before the import, not after
	os.environ['gpt_path'] = job['gpt']
	os.environ['sovits_path'] = job['sovits']

	#	English G2P needs the tagger / cmudict the install ships with;
	#	Voiceger.command exports the same path
	nltk_data = os.path.join(os.path.dirname(root), 'nltk_data')
	if os.path.isdir(nltk_data):
		os.environ.setdefault('NLTK_DATA', nltk_data)

	import soundfile as sf
	from AR.modules.activation import MhaPatched
	from GPT_SoVITS.inference_webui import (
		change_gpt_weights,
		change_sovits_weights,
		get_tts_wav,
	)

	with MhaPatched():
		change_gpt_weights(gpt_path=job['gpt'])
		change_sovits_weights(sovits_path=job['sovits'])
		for item in job['items']:
			chunks = list(get_tts_wav(
				ref_wav_path=job['ref_audio'],
				prompt_text=job['ref_text'],
				prompt_language=job['ref_lang'],
				text=item['text'],
				text_language=job['lang'],
				top_p=1,
				temperature=1,
			))
			if not chunks:
				raise SystemExit(f'voiceger produced no audio for: {item["text"][:40]}')
			rate, data = chunks[-1]
			sf.write(item['out'], data, rate)
			print(f'voiceger → {item["out"]}', flush=True)


if __name__ == '__main__':
	main()
