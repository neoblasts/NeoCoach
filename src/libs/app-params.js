// Simplified app params for local version (no Base44 dependency)
export const appParams = {
	appId: 'local-lifeos',
	token: null,
	fromUrl: typeof window !== 'undefined' ? window.location.href : '',
	functionsVersion: 'local',
	appBaseUrl: ''
}
