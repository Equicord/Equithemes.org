interface ParsedSourceUrl {
    owner: string;
    repo: string;
    branch: string;
    path: string;
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function isBinaryContent(content: string): boolean {
    const binaryMarkers = ["JFIF", "Photoshop", "PNG", "GIF8", "PDF-"];

    if (binaryMarkers.some(marker => content.includes(marker))) {
        return true;
    }

    const sample = content.slice(0, 500);
    let nonPrintable = 0;
    for (let i = 0; i < sample.length; i++) {
        const code = sample.charCodeAt(i);
        if (code === 0) return true;
        if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
            nonPrintable++;
        }
    }

    return nonPrintable > sample.length * 0.1;
}

function isRawHtml(content: string): boolean {
    const lowerContent = content.trim().toLowerCase();
    return (
        lowerContent.includes("<!doctype html") ||
        lowerContent.includes("<html") ||
        lowerContent.includes("<head") ||
        lowerContent.includes("<body") ||
        lowerContent.includes("<?xml") ||
        lowerContent.includes("<script")
    );
}

export async function parseSourceUrl(url: string): Promise<string> {
    if (!url) throw new Error("URL is required");

    let result: string;

    const parsed = parseUrl(url);
    if (parsed) {
        result = await fetchApiContent(parsed);
    } else {
        result = await fetchRawContent(url);
    }

    if (isRawHtml(result)) {
        throw new Error("Content appears to be raw HTML. Please provide a direct link to the CSS file.");
    }

    if (isBinaryContent(result)) {
        throw new Error("Content appears to be a binary file (image, PDF, etc.). Please provide a direct link to the CSS file.");
    }

    const rawContent = Buffer.from(result.trim(), "utf-8").toString("base64");
    return rawContent;
}

function parseUrl(url: string): ParsedSourceUrl | null {
    // eslint-disable-next-line no-useless-escape
    const pattern = /github\.com\/([^\/]+)\/([^\/]+)\/(?:blob|tree)\/([^\/]+)\/(.+)/;
    const match = url.match(pattern);

    if (match) {
        const [, owner, repo, branch, path] = match;
        return { owner, repo, branch, path };
    }
    return null;
}

async function fetchRawContent(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.text();
    } catch (error: any) {
        throw new Error(`Failed to fetch from URL: ${error.message}`);
    }
}

async function fetchApiContent(parsed: ParsedSourceUrl): Promise<string> {
    const { owner, repo, branch, path } = parsed;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    const headers = GITHUB_TOKEN
        ? {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${GITHUB_TOKEN}`
        }
        : {};

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Failed to fetch from GitHub API: ${response.statusText}`);

        const data: any = await response.json();
        if (!data.content) throw new Error("No content found in GitHub API response");

        return Buffer.from(data.content, "base64").toString("utf-8");
    } catch (error: any) {
        throw new Error(`GitHub API fetch failed: ${error.message}`);
    }
}
