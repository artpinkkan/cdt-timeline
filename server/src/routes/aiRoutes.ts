import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// POST generate tasks from project description using Claude Sonnet 4.6
router.post('/generate-tasks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { projectName, description } = req.body;

    if (!projectName || !description) {
      return res.status(400).json({ error: 'projectName and description are required' });
    }

    const systemPrompt = `You are a project planning assistant. Generate realistic task breakdowns for project timelines spanning Jan 2026–Dec 2027.
Return ONLY valid JSON matching the specified schema. Do not include any markdown formatting or code blocks.`;

    const userPrompt = `Project: "${projectName}"
Description: "${description}"
Generate 5–12 specific, actionable tasks. Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "subject": "string",
      "planStart": "YYYY-MM-DD",
      "planEnd": "YYYY-MM-DD",
      "pic": "string"
    }
  ]
}
Dates must fall within 2026-01-01 to 2027-12-31. PIC should be a role title (e.g. "Dev Lead", "QA", "PM").`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      output_config: {
        format: {
          type: 'json_object',
          schema: {
            type: 'object',
            properties: {
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    subject: { type: 'string' },
                    planStart: { type: 'string' },
                    planEnd: { type: 'string' },
                    pic: { type: 'string' },
                  },
                  required: ['subject', 'planStart', 'planEnd', 'pic'],
                  additionalProperties: false,
                },
              },
            },
            required: ['tasks'],
            additionalProperties: false,
          },
        },
      },
    });

    // Extract the text content from the response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return res.status(500).json({ error: 'No text content in Claude response' });
    }

    // Parse the JSON response
    const generatedData = JSON.parse(textContent.text);

    // Validate that tasks is an array
    if (!Array.isArray(generatedData.tasks)) {
      return res.status(500).json({ error: 'Invalid response format from Claude' });
    }

    // Return the generated tasks
    res.json({ tasks: generatedData.tasks });
  } catch (error) {
    console.error('Generate tasks error:', error);
    if (error instanceof SyntaxError) {
      return res.status(500).json({ error: 'Failed to parse Claude response' });
    }
    res.status(500).json({ error: 'Failed to generate tasks' });
  }
});

export default router;
