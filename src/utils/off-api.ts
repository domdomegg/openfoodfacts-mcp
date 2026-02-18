import type {Config} from '../tools/types.js';

function getBaseUrl(config: Config): string {
	return `https://${config.country}.openfoodfacts.org`;
}

async function handleApiError(response: Response): Promise<never> {
	const errorText = await response.text();
	throw new Error(`Open Food Facts API error: ${response.status} ${response.statusText} - ${errorText}`);
}

export async function offGet(
	config: Config,
	endpoint: string,
	params?: Record<string, string>,
): Promise<unknown> {
	const url = new URL(`${getBaseUrl(config)}${endpoint}`);
	if (params) {
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
	}

	const response = await fetch(url.toString(), {
		headers: {
			'User-Agent': config.userAgent,
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		await handleApiError(response);
	}

	return response.json();
}

export async function offPost(
	config: Config,
	endpoint: string,
	body: Record<string, string>,
): Promise<unknown> {
	if (!config.userId || !config.password) {
		throw new Error('OFF_USER_ID and OFF_PASSWORD are required for write operations');
	}

	const formBody = new URLSearchParams({
		...body,
		user_id: config.userId,
		password: config.password,
	});

	const response = await fetch(`${getBaseUrl(config)}${endpoint}`, {
		method: 'POST',
		headers: {
			'User-Agent': config.userAgent,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: formBody.toString(),
	});

	if (!response.ok) {
		await handleApiError(response);
	}

	const text = await response.text();
	return text ? JSON.parse(text) : {status: 1};
}

export async function offPostMultipart(
	config: Config,
	endpoint: string,
	formData: FormData,
): Promise<unknown> {
	if (!config.userId || !config.password) {
		throw new Error('OFF_USER_ID and OFF_PASSWORD are required for write operations');
	}

	formData.set('user_id', config.userId);
	formData.set('password', config.password);

	const response = await fetch(`${getBaseUrl(config)}${endpoint}`, {
		method: 'POST',
		headers: {
			'User-Agent': config.userAgent,
		},
		body: formData,
	});

	if (!response.ok) {
		await handleApiError(response);
	}

	const text = await response.text();
	return text ? JSON.parse(text) : {status: 1};
}

export async function offRequest(
	config: Config,
	method: string,
	endpoint: string,
	params?: Record<string, string>,
	body?: Record<string, string>,
): Promise<unknown> {
	if (method === 'GET') {
		return offGet(config, endpoint, params);
	}

	const mergedBody = {...params, ...body};

	if (config.userId && config.password) {
		mergedBody.user_id = config.userId;
		mergedBody.password = config.password;
	}

	const formBody = new URLSearchParams(mergedBody);

	const response = await fetch(`${getBaseUrl(config)}${endpoint}`, {
		method,
		headers: {
			'User-Agent': config.userAgent,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: formBody.toString(),
	});

	if (!response.ok) {
		await handleApiError(response);
	}

	const text = await response.text();
	return text ? JSON.parse(text) : {status: 1};
}
