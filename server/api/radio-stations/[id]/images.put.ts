import { eq } from 'drizzle-orm';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { radioChannels } from '~/server/db/schema/radio-channels';
import { db } from '~/server/db';

export default defineEventHandler(async (event): Promise<any> => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Channel ID is required' });
  }

  // Verify user session and ownership
  const session = await getUserFromEvent(event);
  const userId = session?.userId;

  // Verify station exists and belongs to user
  const station = await db.query.radioChannels.findFirst({
    where: eq(radioChannels.channelId, id),
  });

  if (!station) {
    throw createError({ statusCode: 404, statusMessage: 'Radio station not found' });
  }

  if (station.userId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have permission to modify this radio station' });
  }
  
  // Read request body
  const { logoImageBase64, logoImageExtension, backgroundImageBase64, backgroundImageExtension } = await readBody(event);
  
  // Process and save images
  const updateData: Partial<typeof station> = {};
  
  if (logoImageBase64 && logoImageExtension) {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'radio', 'logos');
    await mkdir(uploadsDir, { recursive: true });
    const uniqueFilename = `${uuidv7()}${logoImageExtension}`;
    const filePath = path.join(uploadsDir, uniqueFilename);
    await writeFile(filePath, Buffer.from(logoImageBase64, 'base64'));
    updateData.logoImagePath = `/uploads/radio/logos/${uniqueFilename}`;
  }
  
  if (backgroundImageBase64 && backgroundImageExtension) {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'radio', 'backgrounds');
    await mkdir(uploadsDir, { recursive: true });
    const uniqueFilename = `${uuidv7()}${backgroundImageExtension}`;
    const filePath = path.join(uploadsDir, uniqueFilename);
    await writeFile(filePath, Buffer.from(backgroundImageBase64, 'base64'));
    updateData.backgroundImagePath = `/uploads/radio/backgrounds/${uniqueFilename}`;
  }
  
  // Update database if we have changes
  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date().toISOString();
    await db.update(radioChannels)
      .set(updateData)
      .where(eq(radioChannels.channelId, id));
  }
  
  // Return updated station data
  const updatedStation = await db.query.radioChannels.findFirst({
    where: eq(radioChannels.channelId, id),
  });
  
  return updatedStation;
});
