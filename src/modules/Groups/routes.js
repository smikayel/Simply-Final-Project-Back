import { Router } from 'express'
import { validateSchema, verifyRoles } from '../../helpers/validations.js'
import {
  handleCreateGroup,
  handleGetAllGroups,
  handleGetGroupById,
  handleDeleteGroupById,
  handleGetGroupUsers,
} from './service.js'
import validations from './validation.js'

const { createGroupSchema, getGroupByIdSchema, deleteGroupSchema, getGroupUsersSchema } =
  validations

const router = Router()

router.get('/', verifyRoles(['Admin']), handleGetAllGroups)
router.get(
  '/:id/users',
  validateSchema(getGroupUsersSchema),
  verifyRoles(['Admin', 'Teacher', 'Student']),
  handleGetGroupUsers
)
router.post('/', validateSchema(createGroupSchema), verifyRoles(['Admin']), handleCreateGroup)
router.delete('/', validateSchema(deleteGroupSchema), verifyRoles(['Admin']), handleDeleteGroupById)
router.get('/:id', validateSchema(getGroupByIdSchema), verifyRoles(['Admin']), handleGetGroupById)

export { router as groupsRoutes }
