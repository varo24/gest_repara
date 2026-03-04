
/**
 * Servicio de Integración con Google Drive para Backup y Sincronización LAN
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

let accessToken: string | null = null;
let CLIENT_id_placeholder = '';

export const setGoogleClientId = (id: string) => { CLIENT_id_placeholder = id; };

export const googleDriveService = {
  authenticate: (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_id_placeholder,
          scope: SCOPES,
          callback: (response: any) => {
            if (response.error) reject(response.error);
            else {
              accessToken = response.access_token;
              resolve(response.access_token);
            }
          },
        });
        client.requestAccessToken();
      } catch (e) {
        reject(e);
      }
    });
  },

  uploadBackup: async (jsonData: string, fileName: string): Promise<boolean> => {
    if (!accessToken) throw new Error("No autenticado");

    const metadata = { name: fileName, mimeType: 'application/json' };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([jsonData], { type: 'application/json' }));

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    return response.ok;
  },

  /**
   * Busca el archivo de backup más reciente y lo descarga
   */
  downloadLatestBackup: async (): Promise<string | null> => {
    if (!accessToken) throw new Error("No autenticado");

    // 1. Buscar el archivo más reciente que empiece por 'reparapro_backup_'
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name contains 'reparapro_backup_' and mimeType = 'application/json'&orderBy=createdTime desc&pageSize=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listResponse.json();

    if (!listData.files || listData.files.length === 0) return null;

    const fileId = listData.files[0].id;

    // 2. Descargar el contenido del archivo
    const fileResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    return await fileResponse.text();
  }
};
