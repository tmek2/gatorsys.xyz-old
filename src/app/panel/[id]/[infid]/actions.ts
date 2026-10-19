'use server'

import { revalidatePath } from 'next/cache'
import { previewBotRequest } from '@/preview/server'

export async function updateInfraction(guildId: string, infractionId: string, data: any) {
  const res = await previewBotRequest('UpdateInfraction', { server: guildId, id: infractionId }, data, 'POST')

  if (!res.ok) {
    throw new Error('Failed to update infraction')
  }

  revalidatePath(`/panel/${guildId}/${infractionId}`)
  return res.json()
}
