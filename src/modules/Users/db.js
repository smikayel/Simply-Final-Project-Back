import { prisma } from '../../services/Prisma.js'

const { user, userGroup, userTest } = prisma

export const getAllUsers = async () => {
  try {
    const users = await user.findMany()
    return users
  } catch (error) {
    return error
  }
}

export const getUser = async (data) => {
  try {
    const foundUser = await user.findUnique({
      where: data,
      include: {
        role: true,
      },
    })
    return foundUser
  } catch (error) {
    return error
  }
}

export const updateUserbyId = async (id, data) => {
  try {
    const updatedUser = await user.update({
      where: {
        id,
      },
      data,
    })
    return updatedUser
  } catch (error) {
    return error
  }
}

export const deleteUserById = async (id) => {
  try {
    const deletedUser = await user.delete({
      where: {
        id,
      },
    })
    return deletedUser
  } catch (error) {
    return error
  }
}

export const createUser = async (data) => {
  try {
    const createdUser = await user.create({
      data,
    })
    return createdUser
  } catch (error) {
    return error
  }
}

export const getUserTests = async (id) => {
  try {
    const foundedTests = await user.findUnique({
      where: { id },
      select: {
        userTest: {
          select: {
            test: true,
          },
        },
      },
    })
    return foundedTests.userTest
  } catch (error) {
    return error
  }
}

export const addMark = async (teacherEmail, { studentId: userId, testId, mark }) => {
  let { userGroup: teacherGroups } = await user.findUnique({
    select: {
      userGroup: {
        select: { groupId: true },
      },
    },
    where: {
      email: teacherEmail,
    },
  })

  teacherGroups = teacherGroups.map((elem) => elem.groupId)

  if (teacherGroups.length === 0) {
    throw new Error('You cant add mark for this test')
  }
  const foundUser = await userGroup.findFirst({
    where: {
      userId,
      groupId: {
        in: teacherGroups,
      },
    },
  })
  if (!foundUser) {
    throw new Error('You cant add mark for this student')
  }
  const updatedUserTest = await userTest.update({
    where: {
      userId_testId: {
        userId,
        testId,
      },
    },
    data: {
      mark,
    },
  })
  return updatedUserTest
}
