export type ChatEmotion = 'neutral' | 'joy' | 'sadness' | 'anger' | 'surprise' | 'smirk';
const emotions: ChatEmotion[] = ['neutral', 'joy', 'sadness', 'anger', 'surprise', 'smirk'];
/** Explicit model tags take priority; this small local fallback handles missing tags. */
export function sentenceEmotion(text: string): ChatEmotion {
  const tag = text.match(/\[(neutral|joy|sadness|anger|surprise|smirk|fear|disgust)\]/i)?.[1].toLowerCase();
  if (tag === 'fear') return 'surprise';
  if (tag === 'disgust') return 'anger';
  if (tag && emotions.includes(tag as ChatEmotion)) return tag as ChatEmotion;
  if (/\b(sorry|my condolences|i understand how hard|that sounds painful|i'm sad)\b/i.test(text)) return 'sadness';
  if (/\b(wow|oh my|really\?|unbelievable|what a surprise)\b/i.test(text)) return 'surprise';
  if (/\b(i'm angry|i am angry|i'm upset|that's frustrating)\b/i.test(text)) return 'anger';
  if (/\b(teasing|cheeky|got you|just kidding)\b/i.test(text)) return 'smirk';
  if (/\b(hey|hello|hi|yay|hooray|great|wonderful|happy|glad|love|congratulations|thank you)\b/i.test(text)) return 'joy';
  return 'neutral';
}
export function chatActing(text: string, modelName: string) {
  const emotion = sentenceEmotion(text);
  const expression = modelName.startsWith('mao_pro')
    ? ({neutral:'exp_01', joy:'exp_02', sadness:'exp_05', anger:'chat_anger', surprise:'exp_07', smirk:'exp_06'} as const)[emotion]
    : modelName.startsWith('nori_cream') ? `chat_${emotion}` : undefined;
  return {emotion, expression, motion:{group:'Chat',index:emotions.indexOf(emotion)}};
}
export function spokenText(text: string): string {
  return text.replace(/\[(neutral|joy|sadness|anger|surprise|smirk|fear|disgust)\]/gi,'').trim();
}
