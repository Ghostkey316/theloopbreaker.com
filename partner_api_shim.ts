/** Compatibility shim for partner APIs */
export async function openaiChat(prompt: string): Promise<string> {
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI();
    const resp = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60
    });
    return resp.choices[0].message.content;
  } catch (err) {
    return 'openai unavailable';
  }
}

export async function ns3Quiz(user: string): Promise<{ score: number }> {
  try {
    const ns3 = await import('ns3');
    return await ns3.fetchQuiz(user);
  } catch (err) {
    return { score: 0 };
  }
}

export async function worldcoinVerify(user: string, worldId: string): Promise<boolean> {
  try {
    const worldcoin = await import('worldcoin');
    return await worldcoin.verify(user, worldId);
  } catch (err) {
    return false;
  }
}
