export type Config = {
	/** Open Food Facts user ID (for write operations) */
	userId?: string;
	/** Open Food Facts password (for write operations) */
	password?: string;
	/** User-Agent in format "AppName/Version (email)" - required by OFF API */
	userAgent: string;
	/** Country subdomain (default: 'world') */
	country: string;
};
