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

class IdeaCloudDB extends Dexie {
  fragments!: Table<IdeaFragment, string>
  clusters!: Table<CloudCluster, string>
  constructor() {
    super('ideacloud-db')
    this.version(2).stores({
      fragments: 'id, createdAt, clusterId, *tags',
      clusters: 'id, label'
    })
  }
}
export const db = new IdeaCloudDB()
