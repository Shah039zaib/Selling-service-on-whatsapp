import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { prisma } from '../config/database.js';
import { logger, createChildLogger } from '../utils/logger.js';
import {
  AIProviderType,
  AIProviderConfig,
  AIGenerationResult,
  AIConversationContext,
  AIMessage,
} from '../types/index.js';

interface AIProvider {
  generate(
    systemPrompt: string,
    messages: AIMessage[],
    context: AIConversationContext
  ): Promise<AIGenerationResult>;
}

class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.config = config;
  }

  async generate(
    systemPrompt: string,
    messages: AIMessage[],
    _context: AIConversationContext
  ): Promise<AIGenerationResult> {
    const startTime = Date.now();

    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: this.config.model || 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const content =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    return {
      content,
      providerId: this.config.id,
      providerType: 'CLAUDE',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - startTime,
    };
  }
}

class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.config = config;
  }

  async generate(
    systemPrompt: string,
    messages: AIMessage[],
    _context: AIConversationContext
  ): Promise<AIGenerationResult> {
    const startTime = Date.now();

    const model = this.client.getGenerativeModel({
      model: this.config.model || 'gemini-1.5-flash',
      systemInstruction: systemPrompt,
    });

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: history as any });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage?.content || '');
    const response = result.response;

    const inputTokens = Math.ceil(
      messages.reduce((acc, m) => acc + m.content.length, 0) / 4
    );
    const outputTokens = Math.ceil(response.text().length / 4);

    return {
      content: response.text(),
      providerId: this.config.id,
      providerType: 'GEMINI',
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
    };
  }
}

class GroqProvider implements AIProvider {
  private client: Groq;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.client = new Groq({ apiKey: config.apiKey });
    this.config = config;
  }

  async generate(
    systemPrompt: string,
    messages: AIMessage[],
    _context: AIConversationContext
  ): Promise<AIGenerationResult> {
    const startTime = Date.now();

    const groqMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    const response = await this.client.chat.completions.create({
      model: this.config.model || 'llama-3.1-8b-instant',
      messages: groqMessages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '';

    return {
      content,
      providerId: this.config.id,
      providerType: 'GROQ',
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      latencyMs: Date.now() - startTime,
    };
  }
}

class CohereProvider implements AIProvider {
  private apiKey: string;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.config = config;
  }

  async generate(
    systemPrompt: string,
    messages: AIMessage[],
    _context: AIConversationContext
  ): Promise<AIGenerationResult> {
    const startTime = Date.now();

    const chatHistory = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
      message: m.content,
    }));

    const lastMessage = messages[messages.length - 1];

    const response = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'command-r',
        message: lastMessage?.content || '',
        preamble: systemPrompt,
        chat_history: chatHistory,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      text?: string;
      meta?: { tokens?: { input_tokens?: number; output_tokens?: number } };
    };

    return {
      content: data.text || '',
      providerId: this.config.id,
      providerType: 'COHERE',
      inputTokens: data.meta?.tokens?.input_tokens || 0,
      outputTokens: data.meta?.tokens?.output_tokens || 0,
      latencyMs: Date.now() - startTime,
    };
  }
}

export class AIService {
  private providers: Map<string, AIProvider> = new Map();
  private providerConfigs: AIProviderConfig[] = [];
  private readonly maxRetries = 3;

  async initialize(): Promise<void> {
    await this.loadProviders();
    await this.resetDailyUsageIfNeeded();

    setInterval(() => this.resetDailyUsageIfNeeded(), 60 * 60 * 1000);

    logger.info(
      { providerCount: this.providers.size },
      'AI service initialized'
    );
  }

  private async loadProviders(): Promise<void> {
    const providers = await prisma.aIProvider.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    this.providerConfigs = [];
    this.providers.clear();

    for (const p of providers) {
      const config: AIProviderConfig = {
        id: p.id,
        type: p.type,
        apiKey: p.apiKey,
        model: p.model || undefined,
        dailyLimit: p.dailyLimit,
        usedToday: p.usedToday,
        priority: p.priority,
      };

      this.providerConfigs.push(config);

      let provider: AIProvider;

      switch (p.type) {
        case 'CLAUDE':
          provider = new ClaudeProvider(config);
          break;
        case 'GEMINI':
          provider = new GeminiProvider(config);
          break;
        case 'GROQ':
          provider = new GroqProvider(config);
          break;
        case 'COHERE':
          provider = new CohereProvider(config);
          break;
        default:
          continue;
      }

      this.providers.set(p.id, provider);
    }
  }

  private async resetDailyUsageIfNeeded(): Promise<void> {
    const now = new Date();
    const providers = await prisma.aIProvider.findMany({
      where: {
        lastResetAt: {
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
    });

    if (providers.length > 0) {
      await prisma.aIProvider.updateMany({
        where: {
          id: { in: providers.map((p) => p.id) },
        },
        data: {
          usedToday: 0,
          lastResetAt: now,
        },
      });

      await this.loadProviders();
      logger.info('Daily AI usage counters reset');
    }
  }

  private getAvailableProvider(): { config: AIProviderConfig; provider: AIProvider } | null {
    for (const config of this.providerConfigs) {
      if (config.usedToday < config.dailyLimit) {
        const provider = this.providers.get(config.id);
        if (provider) {
          return { config, provider };
        }
      }
    }
    return null;
  }

  async generateResponse(context: AIConversationContext): Promise<AIGenerationResult> {
    const log = createChildLogger({
      customerId: context.customerId,
      service: 'ai',
    });

    const systemPrompt = await this.buildSystemPrompt(context);
    const messages = this.prepareMessages(context);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const available = this.getAvailableProvider();

      if (!available) {
        log.error('No AI providers available');
        throw new Error('All AI providers have reached their daily limits');
      }

      const { config, provider } = available;

      try {
        const result = await provider.generate(systemPrompt, messages, context);

        await this.recordUsage(config.id, result);

        config.usedToday++;

        log.info(
          {
            provider: config.type,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            latencyMs: result.latencyMs,
          },
          'AI response generated'
        );

        return result;
      } catch (error) {
        lastError = error as Error;
        log.warn(
          { error, provider: config.type, attempt },
          'AI provider failed, trying next'
        );

        config.usedToday = config.dailyLimit;
      }
    }

    log.error({ error: lastError }, 'All AI providers failed');
    throw lastError || new Error('AI generation failed');
  }

  private async buildSystemPrompt(context: AIConversationContext): Promise<string> {
    const defaultPrompt = await prisma.systemPrompt.findFirst({
      where: { name: 'default', isActive: true },
    });

    const services = await prisma.service.findMany({
      where: { isActive: true },
      include: {
        packages: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    const paymentConfigs = await prisma.paymentConfig.findMany({
      where: { isActive: true },
    });

    const servicesInfo = services
      .map((s) => {
        const packages = s.packages
          .map(
            (p) =>
              `  - ${p.name}: ${p.currency} ${p.price} (${p.duration || 'One-time'})\n    Features: ${p.features.join(', ')}`
          )
          .join('\n');
        return `${s.name}:\n${s.description}\nPackages:\n${packages}`;
      })
      .join('\n\n');

    const paymentInfo = paymentConfigs
      .map(
        (p) =>
          `${p.method}: ${p.accountTitle} - ${p.accountNumber}${p.bankName ? ` (${p.bankName})` : ''}`
      )
      .join('\n');

    const basePrompt =
      defaultPrompt?.content ||
      `You are a helpful sales assistant for a service-based business on WhatsApp.
Your role is to:
1. Greet customers warmly
2. Understand their needs
3. Recommend appropriate services and packages
4. Guide them through the purchase process
5. Collect payment information
6. Provide support

IMPORTANT RULES:
- ONLY recommend services and packages that are listed below
- NEVER invent or suggest services that don't exist
- NEVER modify prices or offer discounts unless explicitly configured
- Be professional, friendly, and helpful
- If a customer asks for something we don't offer, politely explain what we do offer
- Always confirm details before processing orders`;

    return `${basePrompt}

AVAILABLE SERVICES AND PACKAGES:
${servicesInfo}

PAYMENT METHODS:
${paymentInfo}

CUSTOMER INFORMATION:
- Name: ${context.customerName || 'Unknown'}
- Language preference: ${context.language}
- Phone: ${context.phoneNumber}

${context.currentIntent ? `Current conversation stage: ${context.currentIntent}` : ''}
${context.selectedService ? `Selected service: ${context.selectedService.name}` : ''}
${context.selectedPackage ? `Selected package: ${context.selectedPackage.name} (${context.selectedPackage.currency} ${context.selectedPackage.price})` : ''}
${context.orderInProgress ? `Order in progress: ${context.orderInProgress.orderNumber} - Status: ${context.orderInProgress.status}` : ''}

Respond in ${context.language === 'ur' ? 'Urdu (using Roman Urdu script)' : context.language === 'ar' ? 'Arabic' : 'English'}.
Keep responses concise and suitable for WhatsApp (under 500 characters when possible).`;
  }

  private prepareMessages(context: AIConversationContext): AIMessage[] {
    const recentHistory = context.conversationHistory.slice(-10);

    return recentHistory.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));
  }

  private async recordUsage(
    providerId: string,
    result: AIGenerationResult
  ): Promise<void> {
    try {
      await prisma.$transaction([
        prisma.aIUsageLog.create({
          data: {
            providerId,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            latencyMs: result.latencyMs,
            success: true,
          },
        }),
        prisma.aIProvider.update({
          where: { id: providerId },
          data: {
            usedToday: { increment: 1 },
          },
        }),
      ]);
    } catch (error) {
      logger.error({ error, providerId }, 'Failed to record AI usage');
    }
  }

  async reloadProviders(): Promise<void> {
    await this.loadProviders();
    logger.info('AI providers reloaded');
  }

  getProviderStats(): {
    id: string;
    type: AIProviderType;
    usedToday: number;
    dailyLimit: number;
    available: boolean;
  }[] {
    return this.providerConfigs.map((c) => ({
      id: c.id,
      type: c.type,
      usedToday: c.usedToday,
      dailyLimit: c.dailyLimit,
      available: c.usedToday < c.dailyLimit,
    }));
  }
}

export const aiService = new AIService();
