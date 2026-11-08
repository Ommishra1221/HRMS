import client from './axiosInstance'

const base = '/api/probation'
export const queryProbation = (path, params, signal) => client.get(`${base}${path}`, { params, signal }).then((r) => r.data)
export const createAssessment = (body) => client.post(`${base}/assessments`, body).then((r) => r.data)
export const updateAssessment = (id, body) => client.put(`${base}/assessments/${id}`, body).then((r) => r.data)
export const saveEvaluation = (id, body) => client.put(`${base}/assessments/${id}/evaluation`, body).then((r) => r.data)
export const assessmentAction = (id, action, body) => client.post(`${base}/assessments/${id}/${action}`, body).then((r) => r.data)
