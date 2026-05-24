import { Client } from "@notionhq/client";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { email, platform = "web" } = await request.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

    if (!validEmail) {
      return new Response(JSON.stringify({ error: "Use a valid email address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const normalizedPlatform =
      typeof platform === "string" && platform.trim().length > 0
        ? platform.trim()
        : "web";

    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDataSourceId = process.env.NOTION_WAITLIST_DATASOURCE_ID;

    if (!notionApiKey || !notionDataSourceId) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const notion = new Client({ auth: notionApiKey });
    const existingEntries = await notion.dataSources.query({
      data_source_id: notionDataSourceId,
      filter: {
        property: "Email",
        title: {
          equals: normalizedEmail,
        },
      },
      page_size: 1,
    });

    if (existingEntries.results.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyAdded: true,
          message: "You're already on the waitlist.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const newPage = await notion.pages.create({
      parent: {
        type: "data_source_id",
        data_source_id: notionDataSourceId,
      },
      properties: {
        Email: {
          title: [
            {
              text: {
                content: normalizedEmail,
              },
            },
          ],
        },
        Date: {
          date: {
            start: new Date().toISOString(),
          },
        },
        Platform: {
          multi_select: [{ name: normalizedPlatform }],
        },
        App: {
          multi_select: [{ name: "serendipity" }],
        },
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        pageId: newPage.id,
        alreadyAdded: false,
        message: "Successfully joined the Serendipity waitlist.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: `Failed to add email to waitlist: ${error instanceof Error ? error.message : "Unknown error"}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
