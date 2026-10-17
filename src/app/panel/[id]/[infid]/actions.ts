'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getSiteUrl } from '@/utils/site-url'

export async function updateInfraction(guildId: string, infractionId: string, data: any) {
  const res = await fetch(
    `${getSiteUrl()}/api/infractions/${guildId}/${infractionId}/update`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': (await cookies()).toString()
      },
      body: JSON.stringify(data),
    }
  )

  if (!res.ok) {
    throw new Error('Failed to update infraction')
  }

  revalidatePath(`/panel/${guildId}/${infractionId}`)
  return res.json()
}
