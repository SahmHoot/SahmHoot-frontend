import "./ProfessorRoutes.css";
import { Navigate, Route, Routes } from "react-router-dom";
import { Header } from "../features/professor/components/Header";
import { EndClassDialog } from "../features/professor/components/EndClassDialog";
import { ProfessorHome } from "../features/professor/screens/ProfessorHome";
import { CreateRoom } from "../features/professor/screens/CreateRoom";
import { QuizSetList } from "../features/professor/screens/QuizSetList";
import { QuizSetEditor } from "../features/professor/screens/QuizSetEditor";
import { ProfessorRoom } from "../features/professor/screens/ProfessorRoom";
import { QuizResults } from "../features/professor/screens/QuizResults";
import { useProfessorDashboard } from "../features/professor/hooks/useProfessorDashboard";
import { RoomEndedNotice } from "../features/room/RoomEndedNotice";
import { ClassroomStatus } from "../features/room/ClassroomStatus";

export default function ProfessorRoutes() {
  const professor = useProfessorDashboard();
  const { room, quiz, messages, notice } = professor;

  return (
    <div className="professor-layout">
      <a href="#professor-content" className="professor-layout__skip-link">
        본문으로 이동
      </a>
      <Header room={room} quiz={quiz} onEnd={() => professor.setEnding(true)} />
      <div id="professor-content" tabIndex={-1}>
        <Routes>
          <Route index element={<ProfessorHome onOpen={professor.openRoom} />} />
          <Route
            path="create"
            element={<CreateRoom room={room} onCreate={professor.createRoom} />}
          />
          <Route
            path="sets"
            element={<QuizSetList />}
          />
          <Route
            path="sets/:setId"
            element={
              <QuizSetEditor
                key={professor.editorKey}
              />
            }
          />
          <Route
            path="room"
            element={
              professor.roomEnded ? null : professor.roomLoading || professor.roomError ?
              <ClassroomStatus error={professor.roomError} onHome={professor.dismissRoom} /> :
              <ProfessorRoom
                room={room}
                quiz={quiz}
                quizReady={professor.quizReady}
                onStartQuiz={(questionSetId) => void professor.startQuiz(questionSetId)}
                onStopQuiz={() => void professor.stopQuiz()}
                messages={messages}
                onSend={professor.sendMessage}
                notice={notice}
                onNoticeChange={professor.setNotice}
              />
            }
          />
          <Route
            path="room/results"
            element={
              professor.roomEnded ? null : professor.roomLoading || professor.roomError ?
              <ClassroomStatus error={professor.roomError} onHome={professor.dismissRoom} /> :
              <QuizResults
                room={room}
                result={quiz.phase === 'results' ? quiz.result : null}
                messages={messages}
                onSend={professor.sendMessage}
                notice={notice}
                onNoticeChange={professor.setNotice}
                onClose={() => void professor.closeResults()}
              />
            }
          />
          <Route path="*" element={<Navigate to="/professor" replace />} />
        </Routes>
      </div>
      {professor.feedback && (
        <div role="status" className="professor-layout__feedback">
          {professor.feedback}
        </div>
      )}
      {professor.roomEnded && <RoomEndedNotice onHome={professor.dismissRoom} />}
      {professor.ending && !professor.roomEnded && (
        <EndClassDialog
          roomName={room.name}
          pending={professor.endPending}
          error={professor.endError}
          onCancel={professor.cancelEnding}
          onConfirm={professor.endRoom}
        />
      )}
    </div>
  );
}
