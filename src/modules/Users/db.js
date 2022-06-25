import { prisma } from '../../services/Prisma.js'
import {
  getAvgMarks,
  storeUsersTest,
  getQuestionsAnswersCount,
  getTestHighestScore,
  getUsersAnsweredQuestions,
  getQuestionMarks,
} from './helpers.js'
import { roleStudentName } from '../constants.js'

const { user, userTest, userTestAnswers } = prisma

export const getAllUsers = async () => {
  try {
    return prisma.$transaction(async (prisma) => {
      const avgMarks = await getAvgMarks(prisma)
      let users = await prisma.user.findMany({
        include: {
          role: true,
        },
      })
      users = users.map((user) => {
        //eslint-disable-next-line
        const { password, refreshToken, ...userData } = user
        userData['avgMark'] = avgMarks.find((avg) => avg.userId === +user.id)?._avg.mark
        return userData
      })

      return users
    })
  } catch (error) {
    return error
  }
}

export const getUser = async (data) => {
  try {
    return prisma.$transaction(async (prisma) => {
      const foundUser = await prisma.user.findUnique({
        where: data,
        include: {
          role: true,
          userTest: true,
          userGroup: {
            select: { group: true },
          },
        },
      })
      if (foundUser) {
        const avgMarks = await getAvgMarks(prisma, foundUser.id)
        foundUser['avgMark'] = avgMarks[0]?._avg?.mark
      }
      return foundUser
    })
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

export const createUsers = async (data) => {
  try {
    const createdUsers = await user.createMany({
      data,
    })
    return createdUsers
  } catch (error) {
    return error
  }
}

export const getUserTests = async (email) => {
  try {
    const foundedTests = await user.findUnique({
      where: { email },
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

export const addMark = async (
  teacherEmail,
  { studentId: userId, testId, mark },
  secure = false,
  prisma = prisma
) => {
  if (!secure) {
    let { userGroup: teacherGroups } = await prisma.user.findUnique({
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
    const foundUser = await prisma.userGroup.findFirst({
      where: {
        userId,
        groupId: {
          in: teacherGroups,
        },
        user: {
          role: {
            name: roleStudentName,
          },
        },
      },
    })
    if (!foundUser) {
      throw new Error('You cant add mark for this student')
    }
  }
  const updatedUserTest = await prisma.userTest.update({
    where: {
      userId_testId: {
        userId,
        testId,
      },
    },
    data: {
      mark,
      isComplete: true,
    },
  })
  return updatedUserTest
}

export const getMarks = async (userId) => {
  const testsMarks = prisma.userTest.findMany({
    where: {
      userId,
    },
    include: {
      test: true,
    },
  })
  return testsMarks
}

export const updateUserTest = async (userId, { testId, ...data }) => {
  const updatedUserTest = await userTest.update({
    data,
    where: {
      userId_testId: {
        userId,
        testId,
      },
    },
  })
  return updatedUserTest
}

export const calculateUserTestMark = async (prisma, answersIds, userId, testId) => {
  const answerData = await getUsersAnsweredQuestions(prisma, answersIds)

  const { highestScore, _count, questions } = await getTestHighestScore(prisma, testId)
  const testQuestions = questions.map((elem) => elem.id)
  const questionMaxMark = highestScore / _count.questions

  const questionAnswerCount = await getQuestionsAnswersCount(prisma, testQuestions)

  const answerCounts = { wrong: {}, correct: {} }
  const answerResult = { wrong: [], correct: [] }
  const questionAnswers = []

  answerData.forEach((answer) => {
    questionAnswers.push({ questionId: answer.questionId, answerId: answer.id, userId, testId })
    answerCounts['wrong'][answer.questionId] = 0
    answerCounts['correct'][answer.questionId] = 0
    if (answer.isCorrect) {
      answerCounts['correct'][answer.questionId]++
      answerResult['correct'].push(answer.id)
      return
    }
    answerCounts['wrong'][answer.questionId]++
    answerResult['wrong'].push(answer.id)
  })
  const { mark, questionMarks } = await getQuestionMarks(
    testQuestions,
    answerCounts,
    questionAnswerCount,
    questionMaxMark,
    highestScore
  )

  return {
    mark,
    correctAnswerIds: answerResult['correct'],
    wrongAnswerIds: answerResult['wrong'],
    questionAnswers,
    questionMarks,
  }
}

export const submitTest = async (body, userId) => {
  return prisma.$transaction(async (prisma) => {
    const { testId, answersIds } = body
    if (answersIds.length === 0) {
      await addMark('dummy', { studentId: userId, testId, mark: 0 }, true, prisma)
      return { mark: 0 }
    }
    const data = await calculateUserTestMark(prisma, answersIds, userId, testId)
    await addMark('dummy', { studentId: userId, testId, mark: data.mark }, true, prisma)
    await storeUsersTest(prisma, data.questionAnswers, userId, testId)
    return data
  })
}

export const getUserTestResults = async (userId, testId) => {
  const { highestScore, _count, questions } = (await getTestHighestScore(prisma, testId)) || {}
  if (!highestScore || !_count || !questions) throw 'Test Not Found'
  const questionMaxMark = highestScore / _count.questions
  const testQuestions = questions.map((elem) => elem.id)
  const questionAnswerCount = await getQuestionsAnswersCount(prisma, testQuestions)

  const usersAnswers = await userTestAnswers.findMany({
    where: {
      testId,
      userId,
    },
    select: {
      answer: true,
    },
  })

  const answerCounts = { wrong: {}, correct: {} }
  const answerResult = { wrong: [], correct: [] }
  usersAnswers.forEach(({ answer }) => {
    answerCounts['wrong'][answer.questionId] = 0
    answerCounts['correct'][answer.questionId] = 0
    if (answer.isCorrect) {
      answerCounts['correct'][answer.questionId]++
      answerResult['correct'].push(answer.id)
      return
    }
    answerCounts['wrong'][answer.questionId]++
    answerResult['wrong'].push(answer.id)
  })

  const { mark, questionMarks } = await getQuestionMarks(
    testQuestions,
    answerCounts,
    questionAnswerCount,
    questionMaxMark,
    highestScore
  )
  return {
    mark,
    correctAnswerIds: answerResult['correct'],
    wrongAnswerIds: answerResult['wrong'],
    questionMarks,
  }
}
