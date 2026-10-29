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

export default function ProfessorRoutes() {
  const professor = useProfessorDashboard();
  const { room, sets, quiz, messages } = professor;

  return (
    <div className="professor-layout">
      <a href="#professor-content" className="professor-layout__skip-link">
        본문으로 이동
      </a>
      <Header room={room} quiz={quiz} onEnd={() => professor.setEnding(true)} />
      <div id="professor-content" tabIndex={-1}>
        <Routes>
          <Route index element={<ProfessorHome room={room} />} />
          <Route
            path="create"
            element={<CreateRoom room={room} onCreate={professor.createRoom} />}
          />
          <Route
            path="sets"
            element={<QuizSetList sets={sets} onDelete={professor.deleteSet} />}
          />
          <Route
            path="sets/:setId"
            element={
              <QuizSetEditor
                key={professor.editorKey}
                sets={sets}
                onSave={professor.saveSet}
              />
            }
          />
          <Route
            path="room"
            element={
              <ProfessorRoom
                room={room}
                sets={sets}
                quiz={quiz}
                setQuiz={professor.setQuiz}
                messages={messages}
                onSend={professor.sendMessage}
              />
            }
          />
          <Route
            path="room/results"
            element={
              <QuizResults
                room={room}
                quiz={quiz}
                messages={messages}
                onSend={professor.sendMessage}
                onClose={professor.closeResults}
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
      {professor.ending && (
        <EndClassDialog
          roomName={room.name}
          onCancel={() => professor.setEnding(false)}
          onConfirm={professor.endRoom}
        />
      )}
    </div>
  );
}
