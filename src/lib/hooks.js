// Consultas compartilhadas entre as telas de ABM, custos e conteúdo.
// As chaves de cache são as mesmas usadas nas invalidações das telas antigas.

import { useQuery } from '@tanstack/react-query'
import {
  listAccounts, listAllAccountServices, listTasks, listRoster, listMicroSegments,
  getSalesCostSettings, listCostEntries, listAbmDismissals, listContents, listServices,
  listEmailTemplates, listEmailMessages, listEmailSettings,
} from './data'

export const useAccounts = () => useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
export const useOpportunities = () => useQuery({ queryKey: ['all-account-services'], queryFn: listAllAccountServices })
export const useTasks = () => useQuery({ queryKey: ['tasks'], queryFn: listTasks })
export const useRoster = () => useQuery({ queryKey: ['roster'], queryFn: listRoster })
export const useServices = () => useQuery({ queryKey: ['services'], queryFn: listServices })
export const useMicroSegments = () => useQuery({ queryKey: ['micro-segments'], queryFn: listMicroSegments })
export const useSalesCost = () => useQuery({ queryKey: ['sales-cost'], queryFn: getSalesCostSettings })
export const useCostEntries = () => useQuery({ queryKey: ['cost-entries'], queryFn: () => listCostEntries() })
export const useDismissals = () => useQuery({ queryKey: ['abm-dismissals'], queryFn: listAbmDismissals })
export const useContents = () => useQuery({ queryKey: ['contents'], queryFn: listContents })
export const useEmailTemplates = () => useQuery({ queryKey: ['email-templates'], queryFn: listEmailTemplates })
export const useEmailMessages = (accountId) =>
  useQuery({ queryKey: ['email-messages', accountId || 'all'], queryFn: () => listEmailMessages(accountId ? { accountId } : {}) })
export const useEmailSettings = () => useQuery({ queryKey: ['email-settings'], queryFn: listEmailSettings })

// Invalida tudo que depende de tarefas/custos de uma vez.
export function invalidateAbm(qc, accountId) {
  ;['tasks', 'cost-entries', 'abm-dismissals', 'all-account-services', 'accounts', 'contents', 'email-messages'].forEach((k) =>
    qc.invalidateQueries({ queryKey: [k] }),
  )
  if (accountId) qc.invalidateQueries({ queryKey: ['account', accountId] })
}
