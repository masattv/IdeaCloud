import Dexie, { Table } from 'dexie'

export interface IdeaFragment {
  id: string
  text: string
  createdAt: string
  star: number
  tags: string[]
  clusterId?: string
  rel: string[]
}

export interface CloudCluster {
  id: string
  label: string
  tagHints: string[]
  fragmentIds: string[]
  score: number
}

export interface InsightCache {
  id: string
  summary: string
  nextSteps: string[]
  titles: string[]
  fragmentIds: string[]
  updatedAt: string
}

class IdeaCloudDB extends Dexie {
  fragments!: Table<IdeaFragment, string>
  clusters!: Table<CloudCluster, string>
  insights!: Table<InsightCache, string>
  constructor() {
    super('ideacloud-db')
    this.version(3).stores({
      fragments: 'id, createdAt, clusterId, *tags',
      clusters: 'id, label',
      insights: 'id'
    })
  }
}
export const db = new IdeaCloudDB()
